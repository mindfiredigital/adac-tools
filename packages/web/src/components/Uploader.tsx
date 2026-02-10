import { useState } from 'react';
import { Upload, FileText, ArrowRight, Loader } from 'lucide-react';

interface UploaderProps {
    onBack: () => void;
}

export const Uploader = ({ onBack }: UploaderProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [svgContent, setSvgContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setSvgContent(null);
        }
    };

    const handleGenerate = async () => {
        if (!file) return;

        setLoading(true);
        setError(null);

        try {
            const text = await file.text();
            
            // Assuming the api endpoint is at the root since we are proxying or strictly same origin
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: text,
                    layout: 'elk' // Default to ELK
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to generate diagram');
            }

            const result = await response.json();
            setSvgContent(result.svg);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!svgContent) return;
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'diagram.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full bg-[#121212] p-8 overflow-y-auto">
             <button onClick={onBack} className="self-start mb-8 text-gray-400 hover:text-white flex items-center gap-2">
                &larr; Back to Home
            </button>

            <div className={`mx-auto w-full my-auto transition-all duration-500 ${svgContent ? 'max-w-[95vw]' : 'max-w-3xl'}`}>
                <div className={`grid gap-8 ${svgContent ? 'grid-cols-1 lg:grid-cols-2 h-[80vh]' : 'grid-cols-1'}`}>
                    
                    {/* Upload Section */}
                    <div className={`bg-[#1e1e1e] p-8 rounded-xl border border-[#333] shadow-2xl ${svgContent ? 'h-full flex flex-col' : ''}`}>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                            <Upload className="text-blue-500" />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-500">
                                Upload YAML Definition
                            </span>
                        </h2>

                        <div className={`flex flex-col gap-6 ${svgContent ? 'flex-1 justify-center' : ''}`}>
                            <div className="border-2 border-dashed border-[#444] rounded-lg p-10 flex flex-col items-center justify-center text-center hover:border-blue-500 transition-colors bg-[#252526]">
                                <input 
                                    type="file" 
                                    accept=".yaml,.yml" 
                                    onChange={onFileChange} 
                                    className="hidden" 
                                    id="fileInput" 
                                />
                                <label htmlFor="fileInput" className="cursor-pointer flex flex-col items-center">
                                    <FileText className="w-12 h-12 text-gray-500 mb-4" />
                                    <span className="text-lg font-medium text-gray-300">
                                        {file ? file.name : "Click to select a .yaml file"}
                                    </span>
                                    <span className="text-sm text-gray-500 mt-2">
                                        Supports ADAC YAML format
                                    </span>
                                </label>
                            </div>

                            <button 
                                onClick={handleGenerate}
                                disabled={!file || loading}
                                className={`py-3 px-6 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                                    !file || loading 
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                }`}
                            >
                                {loading ? <Loader className="animate-spin" /> : <ArrowRight />}
                                {loading ? 'Generating...' : 'Generate Diagram'}
                            </button>

                            {error && (
                                <div className="p-4 bg-red-900/30 border border-red-800 text-red-300 rounded-lg">
                                    Error: {error}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Diagram Preview Section */}
                    {svgContent && (
                        <div className="bg-[#1e1e1e] p-4 rounded-xl border border-[#333] overflow-hidden flex flex-col h-full shadow-2xl">
                            <div className="flex justify-between items-center mb-4 px-4 pt-2 shrink-0">
                                <h3 className="text-lg font-semibold text-gray-300">Generated Diagram</h3>
                                <button 
                                    onClick={handleDownload}
                                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <ArrowRight className="rotate-90" size={16} /> Download SVG
                                </button>
                            </div>
                            <div 
                                className="bg-white rounded-lg p-4 overflow-auto flex-1 flex justify-center items-center"
                                dangerouslySetInnerHTML={{ __html: svgContent }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

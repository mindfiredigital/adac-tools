import { Layout, Upload, FileText } from 'lucide-react';

interface HomeProps {
    onSelect: (mode: 'ui' | 'upload') => void;
}

export const Home = ({ onSelect }: HomeProps) => {
    return (
        <div className="h-full w-full flex items-center justify-center bg-[#121212] flex-col p-4 relative overflow-hidden">
             {/* Decorational Gradients */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(236,114,17,0.1),transparent_50%)] pointer-events-none" />

            <div className="text-center mb-12 z-10">
                <h1 className="text-5xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500">
                    ADAC Diagram Generator
                </h1>
                <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                    Create beautiful AWS architecture diagrams from code or design visually with our interactive builder.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full z-10 mx-auto">
                <button 
                    onClick={() => onSelect('ui')}
                    className="group relative bg-[#1e1e1e] border border-[#333] p-8 rounded-2xl hover:border-orange-500 transition-all duration-300 hover:shadow-2xl hover:shadow-orange-500/10 hover:-translate-y-1 text-center flex flex-col items-center"
                >
                    <div className="w-14 h-14 bg-orange-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:bg-orange-500/30 transition-colors">
                        <Layout className="w-8 h-8 text-orange-400" />
                    </div>
                    <h2 className="text-2xl font-bold mb-3 text-white">Visual Designer</h2>
                    <p className="text-gray-400">
                        Drag and drop AWS components to create your architecture. Export as YAML or SVG.
                    </p>
                    <div className="absolute bottom-6 right-8 opacity-0 group-hover:opacity-100 transition-opacity text-orange-400 font-medium flex items-center gap-1">
                        Start Designing &rarr;
                    </div>
                </button>

                <button 
                    onClick={() => onSelect('upload')}
                    className="group relative bg-[#1e1e1e] border border-[#333] p-8 rounded-2xl hover:border-blue-500 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 text-center flex flex-col items-center"
                >
                    <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-500/30 transition-colors">
                        <Upload className="w-8 h-8 text-blue-400" />
                    </div>
                    <h2 className="text-2xl font-bold mb-3 text-white">Upload YAML</h2>
                    <p className="text-gray-400">
                        Already have an ADAC YAML file? Upload it here to instantly generate your diagram.
                    </p>
                     <div className="absolute bottom-6 right-8 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400 font-medium flex items-center gap-1">
                        Upload File &rarr;
                    </div>
                </button>
            </div>

            <div className="mt-16 flex gap-4 text-gray-600 text-sm">
                 <span className="flex items-center gap-1"><FileText size={14} /> ADAC 0.1</span>
            </div>
        </div>
    );
};

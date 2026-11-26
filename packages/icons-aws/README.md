# @mindfiredigital/adac-icons-aws

AWS icons for ADAC diagrams.

The package contains AWS icon files (PNG and SVG, and one EMF) in `assets/` and
the service-name-to-file map `mappings/icon-map.json`, which refers to 819 of
them. It has no JavaScript API: nothing is meant to be imported from it.

`@mindfiredigital/adac-diagram` and `@mindfiredigital/adac-core` use it
automatically when it is installed in the same project or the same global
install. Without it, AWS diagrams are drawn without icons and one warning names
this package.

## Installation

```bash
npm install @mindfiredigital/adac-icons-aws
```

Install it where `@mindfiredigital/adac-diagram` (or `adac-core`) is installed:

```bash
# one global install
npm install -g @mindfiredigital/adac-diagram @mindfiredigital/adac-icons-aws

# or one project
npm install @mindfiredigital/adac-diagram @mindfiredigital/adac-icons-aws
```

## Attribution

AWS Architecture Icons are the property of Amazon Web Services, Inc. or its
affiliates and are provided under the terms published at
https://aws.amazon.com/architecture/icons/

## See Also

- [@mindfiredigital/adac-diagram](https://www.npmjs.com/package/@mindfiredigital/adac-diagram) - the `adac` CLI and API that uses these icons
- [@mindfiredigital/adac-core](https://www.npmjs.com/package/@mindfiredigital/adac-core) - the generation library that uses these icons

## License

MIT

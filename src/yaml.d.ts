// @rollup/plugin-yaml turns a .yaml import into a plain parsed object at build
// time. It has no idea what shape any given file is, so the import arrives as
// unknown and the module that owns the file asserts its own shape.
declare module '*.yaml' {
  const data: unknown;
  export default data;
}

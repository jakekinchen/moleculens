declare module 'sdf-parser' {
  interface Parser {
    parse(sdf: string): unknown;
  }

  const parser: Parser | ((sdf: string) => unknown);
  export default parser;
}

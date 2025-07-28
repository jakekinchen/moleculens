declare module 'sdf-parser' {
    interface Parser {
        parse(sdf: string): any;
    }
    
    const parser: Parser | ((sdf: string) => any);
    export default parser;
} 
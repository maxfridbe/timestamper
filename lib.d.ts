interface ISQLStatementResult {
    columns: string[];
    values: (string | number)[];
}
declare global {
    interface HTMLElement {
        appendChildren(...arr: HTMLElement[]): void;
    }
}
export declare function loadSqliteFromBuffer(buffer: any): Promise<unknown>;
export declare function execSQL(commands: string): Promise<ISQLStatementResult[]>;
export declare function getColorGenerator(): Generator<string, void, unknown>;
export declare function tableCreate(res: ISQLStatementResult): HTMLTableElement;
export {};

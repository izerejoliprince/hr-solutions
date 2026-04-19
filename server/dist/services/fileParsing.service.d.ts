export interface SupportedUploadFile {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
}
export declare function extractTextFromUploadedFile(file: SupportedUploadFile): Promise<string>;
//# sourceMappingURL=fileParsing.service.d.ts.map
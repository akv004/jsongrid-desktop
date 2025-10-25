export type OpenFileResult = { filePath: string; text: string } | null

declare global {
    interface Window {
        api: {
            openFile(): Promise<OpenFileResult>
            saveFile(data: { filePath?: string; text: string }): Promise<{ filePath: string } | null>
        }
    }
}
export {}
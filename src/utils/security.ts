const ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function getNonce(length = 32): string {
    let result = "";
    for (let i = 0; i < length; i++) {
        const idx = Math.floor(Math.random() * ALPHABET.length);
        result += ALPHABET[idx];
    }
    return result;
}

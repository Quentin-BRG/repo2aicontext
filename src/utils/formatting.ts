export function formatNumber(value: number): string {
    return value.toLocaleString();
}

export function formatTokens(tokens: number): string {
    return `${formatNumber(tokens)} tokens`;
}

export function formatDateTime(value: string | number | null | undefined) {
    if (!value) return "暂无";
    return new Date(value).toLocaleString("zh-CN");
}

export function formatRelativeSaveTime(value: number | null | undefined) {
    if (!value) return "";
    const seconds = Math.max(0, Math.round((Date.now() - value) / 1000));
    if (seconds < 5) return "刚刚";
    if (seconds < 60) return `${seconds} 秒前`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} 分钟前`;
    return formatDateTime(value);
}

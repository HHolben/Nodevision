export function normalizePath(path) {
    console.log("Normalizing path "+path);
    if (!path) return "";
    // Remove leading slash and replace multiple slashes with one
    return path.replace(/^\/+/, "").replace(/\/+/g, "/");
}
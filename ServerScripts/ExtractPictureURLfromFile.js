module.exports = (app, path, fs) => {
    // New function to extract the first image URL from the file content
async function getFirstImageUrl(filePath) {
    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const $ = cheerio.load(fileContent);
        const firstImageSrc = $('img').first().attr('src');

        if (firstImageSrc) {
            if (firstImageSrc.startsWith('http') || firstImageSrc.startsWith('//')) {
                // If the image URL is absolute, return it as is
                return firstImageSrc;
            } else {
                // If the image URL is relative, resolve it to an absolute path
                const imagePath = path.join(path.dirname(filePath), firstImageSrc);
                const resolvedImagePath = path.relative(path.join(__dirname, 'public'), imagePath);
                return resolvedImagePath.split(path.sep).join('/');
            }
        } else {
            return null;
        }
    } catch (error) {
        console.error(`Error reading file for images: ${error}`);
        return null;
    }
}
};
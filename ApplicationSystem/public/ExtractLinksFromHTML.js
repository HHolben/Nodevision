// public/ExtractLinksFromHTML.js
// Purpose: TODO: Add description of module purpose


    // Function to extract hyperlinks from HTML content
    function extractHyperlinks(htmlContent) 
    {
      // Regular expression to match anchor tags with href attributes
      const anchorTags = htmlContent.match(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi) || [];
      return anchorTags.map(tag => {
          const match = tag.match(/href=(["'])(.*?)\1/);
          return match ? match[2] : null;
      }).filter(Boolean); // Filter out nulls
    }
    




// Function to fetch hyperlinks for each new element and add edges

function extractNodeLinks(newElements) {
  newElements.forEach(element => {
    const fileId = element.data.id;

    // Skip directories
    if (element.data.type === 'region') {
      console.log(`Skipping directory node: ${fileId}`);
      return;
    }

    const encodedPath = encodeURIComponent(fileId);

    console.log(`Fetching file content for node: ${fileId}`);
    fetch(`/api/file?path=${encodedPath}`)
      .then(fileResponse => {
        if (!fileResponse.ok) {
          throw new Error(`HTTP error fetching file for node ${fileId}: ${fileResponse.status}`);
        }
        return fileResponse.json();
      })
      .then(fileData => {
        const fileContent = fileData.content || '';
        const links = extractHyperlinks(fileContent);
        links.forEach(link => {
          AddEdgeToGraph(fileId, link);
        });
      })
      .catch(error => {
        console.error(`Error fetching file content for node ${fileId}:`, error);
      });
  });
}

// Nodevision/ApplicationSystem/public/ExtractLinksFromHTML.js
// This file defines browser-side Extract Links From HTML logic for the Nodevision UI. It renders interface components and handles user interactions.
// public/ExtractLinksFromHTML.js
// Purpose: TODO: Add description of module purpose


    function shouldIgnoreLink(rawLink) {
      const link = String(rawLink || '').trim();
      if (!link || link.startsWith('#')) return true;
      return /^(data|javascript|mailto|file):/i.test(link) || /^\/\//.test(link);
    }

    function dedupeLinks(links) {
      const seen = new Set();
      return links
        .map(link => String(link || '').trim())
        .filter(link => {
          if (shouldIgnoreLink(link) || seen.has(link)) return false;
          seen.add(link);
          return true;
        });
    }

    // Function to extract hyperlinks and CSS asset references from HTML content
    function extractHyperlinks(htmlContent) 
    {
      const links = [];
      const attrRegex = /(?:href|src|data-nodevision-font-src|data-nodevision-font-stylesheet)\s*=\s*(["'])(.*?)\1/gi;
      for (const match of htmlContent.matchAll(attrRegex)) {
        links.push(match[2]);
      }
      const cssUrlRegex = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^'"\)]+))\s*\)/gi;
      for (const match of htmlContent.matchAll(cssUrlRegex)) {
        links.push(match[1] || match[2] || match[3]);
      }
      // External http(s) URLs are left in the result. TODO: create external graph nodes when supported.
      return dedupeLinks(links);
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

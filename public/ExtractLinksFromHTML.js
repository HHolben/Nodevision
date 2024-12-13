
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
    
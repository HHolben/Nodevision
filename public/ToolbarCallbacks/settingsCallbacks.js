// settingsCallbacks.js
export const settingsCallbacks = {
    toggleViewMode: (state) => {
      console.log("Toggle View Mode callback fired. State:", state);
      const cyContainer = document.getElementById('cy');
      const fileViewContainer = document.getElementById('file-view');
  
      if (state) {
        // Show graph view.
        cyContainer.style.display = 'block';
        fileViewContainer.style.display = 'none';
        if (window.cy) {
          // Assuming initializeTheGraphStyles is defined elsewhere.
          initializeTheGraphStyles();
          cy.layout({
            name: 'cose',
            animate: true,
            fit: true,
            padding: 30,
            nodeRepulsion: 8000,
            idealEdgeLength: 50,
          }).run();
        }
      } else {
        // Show file view.
        cyContainer.style.display = 'none';
        fileViewContainer.style.display = 'block';
        if (typeof window.fetchDirectoryContents === 'function') {
          window.fetchDirectoryContents();
        } else {
          console.error("window.fetchDirectoryContents is not defined.");
        }
      }
    },
    togglePagePreviewMode: (state) => {
      console.log(state ? 'Preview Mode Enabled' : 'Preview Mode Disabled');
    }
  };
  
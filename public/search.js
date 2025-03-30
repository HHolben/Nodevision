// Nodevision/public/search.js

document.addEventListener('DOMContentLoaded', function () {
    window.ActiveNode = 'defaultNode';
    const searchButton = document.getElementById('searchButton');
    const searchBar = document.getElementById('searchBar');
    const searchResultsDiv = document.getElementById('searchResults');
  
    searchButton.addEventListener('click', function () {
      const searchQuery = searchBar.value.toLowerCase().trim();
      searchResultsDiv.style.display = 'none';
  
      if (searchQuery !== '') {
        // Ensure Cytoscape has been initialized.
        if (typeof cy !== 'undefined') {
          const searchResults = cy.nodes().filter(node =>
            node.data('id').toLowerCase().includes(searchQuery) ||
            node.data('label').toLowerCase().includes(searchQuery)
          );
  
          if (searchResults.length > 0) {
            const resultList = searchResults.map(node =>
              `<li><a href="#" onclick="cy.center(cy.getElementById('${node.data('id')}'))">${node.data('label')}</a></li>`
            ).join('');
            searchResultsDiv.innerHTML = `<ul>${resultList}</ul>`;
            searchResultsDiv.style.display = 'block';
          }
        }
      }
    });
  });
  
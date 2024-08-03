document.addEventListener('DOMContentLoaded', function() {
  fetch('GraphStyles.json')
    .then(response => response.json())
    .then(styles => {
      var elements = [...regions, ...nodes, ...edges];
      createCytoscapeGraph(elements, styles);
    })
    .catch(error => console.error('Error fetching styles:', error));
});

function createCytoscapeGraph(elements, styles) {
  const cy = cytoscape({
    container: document.getElementById('cy'),
    elements: elements,
    style: [
      {
        selector: 'node[imageUrl]',
        style: {
          'background-image': 'data(imageUrl)',
          'background-fit': 'cover',
          'background-clip': 'node',
          'width': '50px',
          'height': '50px',
          'label': 'data(label)'
        }
      },
      {
        selector: 'node[type="region"]',
        style: {
          'background-image': 'data(imageUrl)',
          'background-fit': 'cover',
          'background-clip': 'node',
          'width': '50px',
          'height': '50px',
          'label': 'data(label)',
          'background-color': '#f0f0f0'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 3,
          'line-color': '#ccc',
          'target-arrow-color': '#ccc',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier'
        }
      }
    ]
  });

  let selectedElement = null;

  function updateInfoPanel(element) {
    const infoPanel = document.getElementById('element-info');
    if (!infoPanel) {
      console.error('Info panel element not found.');
      return;
    }

    const iframe = document.getElementById('content-frame');
    let infoHTML = '';

    if (element.isNode()) {
      infoHTML = `<strong>Node:</strong> ${element.data('label')}<br>`;
      window.ActiveNode = element.id();
      infoHTML += `<strong>ID:</strong> ${window.ActiveNode}<br>`;
      console.log('ActiveNode set to:', window.ActiveNode);
      if (element.data('type') === 'region') {
        infoHTML += `<strong>Type:</strong> Region<br>`;
        iframe.src = ''; // Clear the iframe for regions
        infoHTML += `<button id="expand-btn">Expand</button>`;
      } else {
        infoHTML += `<strong>Type:</strong> Node<br>`;
        iframe.src = `http://localhost:8000/${element.id()}`;
        iframe.onload = function() {
          const scale = 0.5; // Adjust the scale factor as needed
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const styleElement = iframeDoc.createElement('style');
          styleElement.innerHTML = `body { transform: scale(${scale}); transform-origin: 0 0; width: ${100 / scale}%; height: ${100 / scale}%; }`;
          iframeDoc.head.appendChild(styleElement);
        };
      }
    } else if (element.isEdge()) {
      infoHTML = `<strong>Edge:</strong> ${element.id()}<br>`;
      infoHTML += `<strong>Source:</strong> ${element.source().id()}<br>`;
      infoHTML += `<strong>Target:</strong> ${element.target().id()}<br>`;
      infoHTML += `<strong>Type:</strong> ${element.data('type') || 'Edge'}<br>`;
      iframe.src = ''; // Clear the iframe for edges
    }
    infoPanel.innerHTML = infoHTML;
    selectedElement = element;

    if (element.data('type') === 'region') {
      document.getElementById('expand-btn').addEventListener('click', () => {
        expandRegion(element);
      });
    }
  }

  function expandRegion(regionElement) {
    const regionId = regionElement.id();
    fetch(`/api/getSubNodes?path=${regionId}`)
      .then(response => response.json())
      .then(subNodes => {
        const newElements = subNodes.map(node => ({
          data: {
            id: node.id,
            label: node.label,
            parent: regionId,
            type: node.isDirectory ? 'region' : 'node',
            imageUrl: node.isDirectory ? 'DefaultRegionImage.png' : 'DefaultNodeImage.png'
          }
        }));
        
        cy.remove(regionElement);
        cy.add([
          { group: 'nodes', data: { id: regionId, label: regionElement.data('label'), type: 'region' } },
          ...newElements
        ]);

        cy.layout({ name: 'cose' }).run();
      })
      .catch(error => console.error('Error expanding region:', error));
  }

  cy.on('click', 'node, edge', function(evt) {
    var element = evt.target;
    updateInfoPanel(element);
  });

  cy.on('tap', function(event){
    if(event.target === cy){
      document.getElementById('element-info').innerHTML = 'Click on a node, edge, or region to see details.';
      document.getElementById('content-frame').src = ''; // Clear the iframe when clicking on the background
      selectedElement = null;
    }
  });
}

// Express route to fetch sub-nodes for a given region
app.get('/api/getSubNodes', async (req, res) => {
  const regionPath = req.query.path;
  if (!regionPath) {
    return res.status(400).send('Region path is required');
  }

  const dirPath = path.join(__dirname, 'Notebook', regionPath);
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const subNodes = entries.map(entry => ({
      id: path.join(regionPath, entry.name),
      label: entry.name,
      isDirectory: entry.isDirectory()
    }));
    res.json(subNodes);
  } catch (error) {
    console.error('Error reading directory:', error);
    res.status(500).send('Error reading directory');
  }
});

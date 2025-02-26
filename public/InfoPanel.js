var iframe = document.getElementById('content-frame');

  
  function updateInfoPanel(element)
  {


    if(element.id==null)
    {
     console.log("selected "+ element);


     var SelectedServerPath=`localhost:3000/Notebook`;
     iframe.src =`http://${SelectedServerPath}/${element}`;
     iframe.onload = function() {
       const scale = 0.5; // Adjust the scale factor as needed
       const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
       const styleElement = iframeDoc.createElement('style');
       styleElement.innerHTML = `body { transform: scale(${scale}); transform-origin: 0 0; width: ${100 / scale}%; height: ${100 / scale}%; }`;
       iframeDoc.head.appendChild(styleElement);
     };
     
     window.ActiveNode =`${element}`;

    }

    console.log("updating info panel for "+ element.id());
    const infoPanel = document.getElementById('element-info');
    
    if (!infoPanel)
    {
      console.error('Info panel element not found.');
      return;
    }

    iframe = document.getElementById('content-frame');
    let infoHTML = '';

    if (element.isNode())
    {
      infoHTML = `<strong>Node:</strong> ${element.data('label')}<br>`;
      window.ActiveNode = element.id();
      infoHTML += `<strong>ID:</strong> ${window.ActiveNode}<br>`;

      if (element.data('type') === 'region') {
        infoHTML += `<strong>Type:</strong> Region<br>`;
        iframe.src = ''; // Clear the iframe for regions
        infoHTML += `<button id="expand-btn">Expand</button>`;
        if (element.isParent()) {
          infoHTML += `<button id="collapse-btn">Collapse</button>`;
        }
      } else {
        infoHTML += `<strong>Type:</strong> Node<br>`;
        var SelectedServerPath=`localhost:3000/Notebook`;
        iframe.src =`http://${SelectedServerPath}/${element.id()}`;
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
        console.log("Edges before: "+cy.edges.id);
        expandRegion(element);
        console.log("Edges after: "+cy.edges);

      });





      

      if (element.isParent()) {
        document.getElementById('collapse-btn').addEventListener('click', () => {
          collapseRegion(element);
        });
      }
    }
  }
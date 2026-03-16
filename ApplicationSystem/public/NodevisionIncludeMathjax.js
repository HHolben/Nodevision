// Nodevision/ApplicationSystem/public/NodevisionIncludeMathjax.js
// This file defines browser-side Nodevision Include Mathjax logic for the Nodevision UI. It renders interface components and handles user interactions.
// public/NodevisionIncludeMathjax.js
// Purpose: TODO: Add description of module purpose

MathJax = {
    tex: {
      inlineMath: [["\\(", "\\)"]],
      displayMath: [["$$", "$$"]]
    },
    options: {
      renderActions: {
        100: [function (doc) {
          doc.find('span.latex-math').each(function (node) {
            node.setAttribute('data-latex', node.textContent);
          });
        }]
      }
    },
    loader: { load: ['[tex]/amsmath'] }
  };
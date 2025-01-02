<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');
// Rest of the script





// Directory to scan
$baseDirectory = '/var/www/html/HenryDavidHolbenJournalAndNotebook';

// Output JavaScript file
$outputFile = 'nodes.js';

// Open the output file for writing
$fileHandle = fopen($outputFile, 'w');

// Write Cytoscape initialization
fwrite($fileHandle, "var cy = cytoscape({\n");
fwrite($fileHandle, "  container: document.getElementById('cy'),\n");
fwrite($fileHandle, "\n");
fwrite($fileHandle, "  elements: [\n");

// Find HTML and PHP files and create nodes
foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($baseDirectory)) as $file) {
    if ($file->isFile() && (pathinfo($file, PATHINFO_EXTENSION) == 'html' || pathinfo($file, PATHINFO_EXTENSION) == 'php')) {
        // Escape backticks in file path
        $escapedFilePath = str_replace('`', '\`', $file);

        // Extract file name without path
        $fileName = basename($file);

        // Extract title from HTML content
        $title = preg_match('/<title>(.*?)<\/title>/', file_get_contents($file), $matches) ? $matches[1] : $fileName;

        // Extract Node variable from JavaScript
        $nodeVar = file_get_contents($file); // Assuming the Node variable is present in the file
        $nodeVar = preg_match('/var Node = (.*?);/', $nodeVar, $matches) ? $matches[1] : '{}';
        $nodeData = json_decode($nodeVar, true);
        $imageLocation = isset($nodeData['imageLocation']) ? $nodeData['imageLocation'] : '';
        $soundLocation = isset($nodeData['SoundLocation']) ? $nodeData['SoundLocation'] : '';

        // Write node entry
        fwrite($fileHandle, "    { data: { id: `$escapedFilePath`, label: `$title`, imageLocation: `$imageLocation`, soundLocation: `$soundLocation` } },\n");
    }
}

// Complete Cytoscape initialization
fwrite($fileHandle, "  ],\n");
fwrite($fileHandle, "\n");
fwrite($fileHandle, "  style: [\n");
fwrite($fileHandle, "    {\n");
fwrite($fileHandle, "      selector: 'node',\n");
fwrite($fileHandle, "      style: {\n");
fwrite($fileHandle, "        'label': 'data(label)',\n");
fwrite($fileHandle, "        'background-color': '#6FB1FC',\n");
fwrite($fileHandle, "        'background-image': 'data(imageLocation)',\n");
fwrite($fileHandle, "        'background-fit': 'cover',\n");
fwrite($fileHandle, "        'width': 200,\n");
fwrite($fileHandle, "        'height': 30\n");
fwrite($fileHandle, "      }\n");
fwrite($fileHandle, "    },\n");
fwrite($fileHandle, "  ],\n");
fwrite($fileHandle, "\n");
fwrite($fileHandle, "  layout: {\n");
fwrite($fileHandle, "    name: 'grid',\n");
fwrite($fileHandle, "  }\n");
fwrite($fileHandle, "});\n");

// Close the output file
fclose($fileHandle);

echo "Nodes generation completed. Check '$outputFile'.";
?>

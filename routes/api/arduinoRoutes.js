const express = require('express');
const SerialPort = require('serialport');
const Avrgirl = require('avrgirl-arduino');
const router = express.Router();

// Endpoint to list available serial ports
router.get('/ports', async (req, res) => {
    try {
        const ports = await SerialPort.list();
        res.json(ports);
    } catch (error) {
        console.error('Error listing serial ports:', error);
        res.status(500).json({ error: 'Failed to list serial ports.' });
    }
});

// Endpoint to upload code to Arduino
router.post('/upload', async (req, res) => {
    const { code, board, port } = req.body;

    if (!code || !board || !port) {
        return res.status(400).json({ error: 'Code, board, and port are required.' });
    }

    const tempSketchPath = path.join(__dirname, 'temp', 'sketch.ino');
    try {
        await fs.mkdir(path.dirname(tempSketchPath), { recursive: true });
        await fs.writeFile(tempSketchPath, code);

        const avrgirl = new Avrgirl({ board, port, debug: true });

        avrgirl.flash(tempSketchPath, (err) => {
            if (err) {
                console.error('Error uploading sketch:', err);
                return res.status(500).json({ error: 'Upload failed.', details: err.message });
            }
            res.json({ message: 'Sketch uploaded successfully.' });
        });
    } catch (error) {
        console.error('Error preparing sketch upload:', error);
        res.status(500).json({ error: 'Failed to prepare upload.' });
    }
});

module.exports = router;

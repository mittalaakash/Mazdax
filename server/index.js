const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the Node.js backend!' });
});
app.use('/api/world', (req, res) => {
  res.json({ message: 'Hello World from the Node.js backend!' });
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

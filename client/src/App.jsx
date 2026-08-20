import { useLayoutEffect } from 'react';
import { useState, useEffect } from 'react';

function App() {
  const [message, setMessage] = useState('Loading...');

  useLayoutEffect(() => {
    fetch(import.meta.env.VITE_API_URL + '/api/world', { method: 'PATCH' })
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(() => setMessage('Could not reach backend'));
  }, []);

  useEffect(() => {
    fetch(import.meta.env.VITE_API_URL + '/api/hello')
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(() => setMessage('Could not reach backend'));
  }, []);

  return <h1>{message}</h1>;
}

export default App;

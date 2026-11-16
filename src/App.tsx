import { HashRouter, Route, Routes } from 'react-router-dom';
import { DataProvider } from './data/DataProvider';

function Home() {
  return <h1>Добро пожаловать</h1>;
}

export default function App() {
  return (
    <DataProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </HashRouter>
    </DataProvider>
  );
}

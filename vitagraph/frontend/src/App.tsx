/**
 * @deprecated The old 3-column App is retired as part of US-02.
 * The official shipping frontend is the Instrument&Paper prototype in `site design/`.
 * The original 3-column implementation is preserved in `legacy/App.tsx`.
 */

export function App() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>VitaGraph — Legacy Frontend Retired</h1>
      <p>
        The 3-column layout has been retired per US-02. The shipping VitaGraph
        interface is located in <code>site design/</code> running on port 5174.
      </p>
      <p>
        Original source preserved in <code>legacy/App.tsx</code>.
      </p>
    </div>
  );
}

export default App;

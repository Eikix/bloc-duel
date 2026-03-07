import { DojoProvider } from "./dojo/DojoContext";
import { StarknetProvider } from "./dojo/StarknetProvider";
import { Game } from "./pages/Game";

function App() {
  return (
    <StarknetProvider>
      <DojoProvider>
        <Game />
      </DojoProvider>
    </StarknetProvider>
  );
}

export default App;

import {} from "react";
import { useAuthStore } from "./stores/auth";
import LoginScreen from "./components/login/LoginScreen";
import MainShell from "./components/shell/MainShell";

function App() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  return (
    <div className="aol-app">
      {isLoggedIn ? <MainShell /> : <LoginScreen />}
    </div>
  );
}

export default App;

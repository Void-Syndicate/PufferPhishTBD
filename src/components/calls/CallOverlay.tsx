/**
 * CallOverlay — Master wrapper that shows the right call UI based on state
 */
import { useCallsStore } from "../../stores/calls";
import IncomingCallDialog from "./IncomingCallDialog";
import OutgoingCallDialog from "./OutgoingCallDialog";
import InCallView from "./InCallView";
import CallEndedDialog from "./CallEndedDialog";
import GroupCallView from "./GroupCallView";

export default function CallOverlay() {
  const activeCall = useCallsStore((s) => s.activeCall);
  const isGroupCall = useCallsStore((s) => s.isGroupCall);

  if (!activeCall) return null;

  // Group call view
  if (isGroupCall && (activeCall.state === "connecting" || activeCall.state === "connected")) {
    return <GroupCallView />;
  }

  switch (activeCall.state) {
    case "ringing":
      return activeCall.direction === "incoming"
        ? <IncomingCallDialog />
        : <OutgoingCallDialog />;
    case "connecting":
    case "connected":
      return <InCallView />;
    case "ended":
      return <CallEndedDialog />;
    default:
      return null;
  }
}

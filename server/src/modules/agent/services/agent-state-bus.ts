// Compatibility wrapper — re-exports from activity-stream.
// All new code should import from '../../../services/activity-stream.js' directly.

export {
  type AgentStateType,
  type AgentStateEvent,
  addStateClient, removeStateClient, broadcastAgentState,
  emitThinking, emitToolCall, emitToolResult, emitResponding,
  emitDone, emitIdle, emitDelegation, emitCommSent, emitCommReceived,
  emitTaskStarted, emitTaskCompleted, emitTaskFailed,
  initRedisPubSub, publishToRedis, isRedisPubSubEnabled,
  getConnectedClientCount, getAgentLastState, getAllAgentStates, getRecentEvents,
} from '../../../services/activity-stream.js';

// DEPRECATED: This file is a compatibility wrapper.
// All new code should import from './activity-stream.js' directly.
// Will be removed after 1 week of stable production.

export {
  type AgentStateType,
  type AgentStateEvent,
  addStateClient, removeStateClient, broadcastAgentState,
  emitThinking, emitToolCall, emitToolResult, emitResponding,
  emitDone, emitIdle, emitDelegation, emitCommSent, emitCommReceived,
  emitTaskStarted, emitTaskCompleted, emitTaskFailed,
  initRedisPubSub, publishToRedis, isRedisPubSubEnabled,
  getConnectedClientCount, getAgentLastState, getAllAgentStates, getRecentEvents,
} from './activity-stream.js';

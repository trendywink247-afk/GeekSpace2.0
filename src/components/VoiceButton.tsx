import { Mic, Loader2 } from 'lucide-react';

export interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
  isListening?: boolean;
  isProcessing?: boolean;
  onClick?: () => void;
  isSupported?: boolean;
}

export function VoiceButton({
  disabled = false,
  className = '',
  isListening = false,
  isProcessing = false,
  onClick,
  isSupported = true,
}: VoiceButtonProps) {
  if (!isSupported) {
    return (
      <button
        disabled
        title='Voice not available in this browser'
        className={`p-2.5 rounded-lg opacity-40 cursor-not-allowed ${className}`}
      >
        <Mic className='w-4 h-4 text-[#6B7280]' />
      </button>
    );
  }

  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled || isProcessing}
      title={isListening ? 'Stop listening' : isProcessing ? 'Processing...' : 'Voice input (Alt+V)'}
      aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      className={[
        'relative p-2.5 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center gap-1.5',
        isListening
          ? 'bg-red-500/20 hover:bg-red-500/30 ring-1 ring-red-400/60'
          : isProcessing
          ? 'bg-[#8B5CF6]/10'
          : 'hover:bg-[#8B5CF6]/10',
        disabled || isProcessing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
        className,
      ].join(' ')}
    >
      {isProcessing ? (
        <Loader2 className='w-4 h-4 text-[#8B5CF6] animate-spin' />
      ) : (
        <>
          <Mic
            className={[
              'w-4 h-4 transition-colors',
              isListening ? 'text-red-400 animate-pulse' : 'text-[#6B7280]',
            ].join(' ')}
          />
          {isListening && (
            <span className='text-[10px] text-red-400 font-medium whitespace-nowrap'>
              Listening...
            </span>
          )}
        </>
      )}
      {/* Pulsing ring when listening */}
      {isListening && (
        <span className='absolute inset-0 rounded-lg ring-2 ring-red-400/50 animate-ping pointer-events-none' />
      )}
    </button>
  );
}

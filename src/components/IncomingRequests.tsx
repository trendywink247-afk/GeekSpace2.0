// ============================================================
// Incoming Contact Requests
// Shows pending requests for user (Y) to accept/decline
// Used in Weebo tab
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Check, X, Clock, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';


interface ContactRequest {
  id: string;
  fromName: string;
  fromUser: {
    name: string;
    avatar: string;
  } | null;
  source: string;
  intention: string | null;
  initialMessage: string | null;
  createdAt: string;
  expiresAt: string;
  channelNotified: string;
}

export function IncomingRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [declineConfirmId, setDeclineConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
    // Poll every 30 seconds
    const interval = setInterval(loadRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadRequests = async () => {
    try {
      const response = await fetch('/api/contact/incoming');
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests);
      }
    } catch {
      // silently fail — UI shows empty state
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const response = await fetch(`/api/contact/${requestId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        // Navigate to conversation
        navigate(`/dashboard/agent?conversation=${data.conversationId}`);
      } else {
        const error = await response.json();
        setActionError(error.error || 'Failed to accept request');
      }
    } catch {
      setActionError('Something went wrong');
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    if (declineConfirmId !== requestId) { setDeclineConfirmId(requestId); return; }
    setDeclineConfirmId(null);
    setProcessing(requestId);
    try {
      const response = await fetch(`/api/contact/${requestId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setRequests(requests.filter(r => r.id !== requestId));
      } else {
        const error = await response.json();
        setActionError(error.error || 'Failed to decline request');
      }
    } catch {
      setActionError('Something went wrong');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageSquare className="w-12 h-12 text-[#8B5CF6]/30 mx-auto mb-3" />
        <p className="text-[#6B7280]">No pending contact requests</p>
        <p className="text-xs text-[#6B7280]/70 mt-1">
          When someone wants to reach you, they'll appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[#E8E8F0]">
          Incoming Requests ({requests.length})
        </h3>
        <Button variant="outline" size="sm" onClick={loadRequests} className="border-[#8B5CF6]/30">
          Refresh
        </Button>
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-[#FF3366]/10 border border-[#FF3366]/30 text-sm text-[#FF3366] flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-2 text-[#FF3366]/70 hover:text-[#FF3366]"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {requests.map((request) => (
        <Card key={request.id} className="glass-card-v2 border-[#8B5CF6]/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center flex-shrink-0">
                {request.fromUser?.avatar ? (
                  <img
                    src={request.fromUser.avatar}
                    alt={request.fromName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 text-[#8B5CF6]" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-[#E8E8F0]">{request.fromName}</span>
                  <span className="text-xs text-[#6B7280]">via {request.source}</span>
                </div>

                {request.intention && (
                  <p className="text-sm text-[#6B7280] mb-2 line-clamp-2">
                    {request.intention}
                  </p>
                )}

                {request.initialMessage && (
                  <div className="p-2 rounded-lg bg-[#06060B] text-sm text-[#6B7280] mb-3 line-clamp-2">
                    "{request.initialMessage}"
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-3">
                  <Clock className="w-3.5 h-3.5" />
                  Expires {new Date(request.expiresAt).toLocaleDateString()}
                  {request.channelNotified !== 'none' && (
                    <span className="text-[#00FF88]">• Notified on {request.channelNotified}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAccept(request.id)}
                    disabled={processing === request.id}
                    className="flex-1 bg-[#00FF88] hover:bg-[#51EF6B] text-[#0C0C18]"
                  >
                    {processing === request.id ? (
                      <div className="w-4 h-4 border-2 border-[#0C0C18] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-1.5" />
                        Accept
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDecline(request.id)}
                    disabled={processing === request.id}
                    className={`flex-1 text-[#FF3366] hover:bg-[#FF3366]/10 ${declineConfirmId === request.id ? 'border-[#FF3366]/60 bg-[#FF3366]/10' : 'border-[#FF3366]/30'}`}
                  >
                    <X className="w-4 h-4 mr-1.5" />
                    {declineConfirmId === request.id ? 'Confirm?' : 'Decline'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

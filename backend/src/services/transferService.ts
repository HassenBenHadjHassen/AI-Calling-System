import { CallStatus } from "../generated/prisma";
import { updateCallHistory } from "../repositories/callRepository";

// Keywords and phrases that trigger human transfer
const TRANSFER_KEYWORDS = [
  // French interest indicators
  'intéressé', 'interessé', 'intéresse', 'interesse',
  'oui', 'si', 'peut-être', 'peut etre', 'pourquoi pas',
  'dites-moi', 'dites moi', 'expliquez', 'expliquez-moi',
  'combien', 'prix', 'coût', 'cout', 'tarif',
  'rendez-vous', 'rendez vous', 'rencontre', 'meeting',
  'rappel', 'rappeler', 'recontacter',
  
  // English equivalents (in case of mixed language)
  'interested', 'yes', 'maybe', 'tell me more',
  'explain', 'how much', 'price', 'cost',
  'appointment', 'meeting', 'callback', 'call back'
];

// Negative keywords that should NOT trigger transfer
const NEGATIVE_KEYWORDS = [
  'non', 'no', 'pas intéressé', 'pas interesse',
  'jamais', 'never', 'arrêtez', 'arretez', 'stop',
  'ne rappellez pas', 'ne rappelez pas', 'don\'t call',
  'pas le temps', 'occupé', 'occupe', 'busy'
];

// Sentiment analysis for transfer decision
export interface TransferAnalysis {
  shouldTransfer: boolean;
  confidence: number;
  triggeredKeywords: string[];
  reason: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export const analyzeForTransfer = (transcript: string, context?: {
  callDuration?: number;
  previousInteractions?: number;
}): TransferAnalysis => {
  const lowerTranscript = transcript.toLowerCase();
  
  // Check for negative keywords first (higher priority)
  const foundNegativeKeywords = NEGATIVE_KEYWORDS.filter(keyword => 
    lowerTranscript.includes(keyword.toLowerCase())
  );
  
  if (foundNegativeKeywords.length > 0) {
    return {
      shouldTransfer: false,
      confidence: 0.9,
      triggeredKeywords: foundNegativeKeywords,
      reason: 'Negative sentiment detected',
      sentiment: 'negative'
    };
  }
  
  // Check for positive transfer keywords
  const foundPositiveKeywords = TRANSFER_KEYWORDS.filter(keyword => 
    lowerTranscript.includes(keyword.toLowerCase())
  );
  
  if (foundPositiveKeywords.length === 0) {
    return {
      shouldTransfer: false,
      confidence: 0.8,
      triggeredKeywords: [],
      reason: 'No transfer keywords detected',
      sentiment: 'neutral'
    };
  }
  
  // Calculate confidence based on multiple factors
  let confidence = Math.min(0.5 + (foundPositiveKeywords.length * 0.2), 0.95);
  
  // Boost confidence if call duration is reasonable (engaged conversation)
  if (context?.callDuration && context.callDuration > 30) {
    confidence += 0.1;
  }
  
  // Reduce confidence if too many previous failed interactions
  if (context?.previousInteractions && context.previousInteractions > 3) {
    confidence -= 0.2;
  }
  
  const shouldTransfer = confidence > 0.6;
  
  return {
    shouldTransfer,
    confidence,
    triggeredKeywords: foundPositiveKeywords,
    reason: shouldTransfer 
      ? `Positive keywords detected: ${foundPositiveKeywords.join(', ')}`
      : 'Confidence threshold not met',
    sentiment: 'positive'
  };
};

// Process transfer request from Vapi.ai webhook
export const processTransferRequest = async (
  callId: string,
  transcript: string,
  vapiData?: any
): Promise<{
  transferApproved: boolean;
  analysis: TransferAnalysis;
  nextAction: string;
}> => {
  try {
    console.log(`Processing transfer request for call ${callId}`);
    
    // Analyze transcript for transfer decision
    const analysis = analyzeForTransfer(transcript, {
      callDuration: vapiData?.duration,
      previousInteractions: vapiData?.previousInteractions
    });
    
    console.log(`Transfer analysis for call ${callId}:`, analysis);
    
    if (analysis.shouldTransfer) {
      // Update call status to indicate transfer
      await updateCallHistory(callId, {
        status: CallStatus.TRANSFERRED,
        transferredToHuman: true,
        metadata: {
          transferReason: analysis.reason,
          transferKeywords: analysis.triggeredKeywords,
          transferConfidence: analysis.confidence,
          transcript: transcript.substring(0, 500) // Store first 500 chars
        }
      });
      
      return {
        transferApproved: true,
        analysis,
        nextAction: 'TRANSFER_TO_HUMAN'
      };
    } else {
      // Continue with AI conversation
      return {
        transferApproved: false,
        analysis,
        nextAction: 'CONTINUE_AI_CONVERSATION'
      };
    }
  } catch (error) {
    console.error('Error processing transfer request:', error);
    
    // Default to safe transfer in case of error
    return {
      transferApproved: true,
      analysis: {
        shouldTransfer: true,
        confidence: 0.5,
        triggeredKeywords: [],
        reason: 'Error in analysis - defaulting to transfer',
        sentiment: 'neutral'
      },
      nextAction: 'TRANSFER_TO_HUMAN'
    };
  }
};

// Generate transfer instructions for Vapi.ai
export const generateTransferInstructions = (analysis: TransferAnalysis): string => {
  if (analysis.shouldTransfer) {
    return `Parfait ! Je vais vous transférer vers un de nos conseillers qui pourra vous donner plus de détails. Veuillez patienter un instant.`;
  } else {
    // Continue conversation based on sentiment
    if (analysis.sentiment === 'negative') {
      return `Je comprends. Puis-je vous laisser mes coordonnées au cas où vous changeriez d'avis ?`;
    } else {
      return `Permettez-moi de vous expliquer brièvement les avantages de notre service...`;
    }
  }
};

export default {
  analyzeForTransfer,
  processTransferRequest,
  generateTransferInstructions
};

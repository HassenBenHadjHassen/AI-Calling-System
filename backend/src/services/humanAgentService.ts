import { env } from "../config/env";

// Human agent availability and routing
interface HumanAgent {
  id: string;
  name: string;
  phone: string;
  isAvailable: boolean;
  currentCalls: number;
  maxConcurrentCalls: number;
  specialties: string[];
}

// Mock human agents - in production, this would come from a database
const HUMAN_AGENTS: HumanAgent[] = [
  {
    id: 'agent-1',
    name: 'Marie Dubois',
    phone: '+33123456789',
    isAvailable: true,
    currentCalls: 0,
    maxConcurrentCalls: 3,
    specialties: ['sales', 'french']
  },
  {
    id: 'agent-2',
    name: 'Pierre Martin',
    phone: '+33123456790',
    isAvailable: true,
    currentCalls: 0,
    maxConcurrentCalls: 2,
    specialties: ['support', 'technical']
  }
];

export interface TransferResult {
  success: boolean;
  agentId?: string;
  agentName?: string;
  agentPhone?: string;
  message: string;
  transferMethod: 'conference' | 'direct' | 'queue';
}

// Find available human agent
export const findAvailableAgent = (specialty?: string): HumanAgent | null => {
  const availableAgents = HUMAN_AGENTS.filter(agent => 
    agent.isAvailable && 
    agent.currentCalls < agent.maxConcurrentCalls &&
    (!specialty || agent.specialties.includes(specialty))
  );
  
  if (availableAgents.length === 0) {
    return null;
  }
  
  // Return agent with least current calls
  return availableAgents.sort((a, b) => a.currentCalls - b.currentCalls)[0];
};

// Transfer call to human agent
export const transferToHuman = async (
  callId: string,
  conferenceSid?: string,
  specialty?: string
): Promise<TransferResult> => {
  try {
    console.log(`Attempting to transfer call ${callId} to human agent`);
    
    // Find available agent
    const agent = findAvailableAgent(specialty);
    
    if (!agent) {
      console.log('No human agents available for transfer');
      return {
        success: false,
        message: 'Aucun conseiller disponible pour le moment. Veuillez rappeler plus tard.',
        transferMethod: 'queue'
      };
    }
    
    // In a real implementation, you would:
    // 1. Call Twilio API to add the agent to the conference
    // 2. Or create a new call to the agent
    // 3. Update agent availability status
    
    console.log(`Transferring call ${callId} to agent ${agent.name} (${agent.phone})`);
    
    // Mock transfer logic - in production, implement actual Twilio transfer
    const transferSuccess = await mockTransferCall(callId, agent, conferenceSid);
    
    if (transferSuccess) {
      // Update agent status
      agent.currentCalls++;
      
      return {
        success: true,
        agentId: agent.id,
        agentName: agent.name,
        agentPhone: agent.phone,
        message: `Transfert vers ${agent.name} réussi`,
        transferMethod: conferenceSid ? 'conference' : 'direct'
      };
    } else {
      return {
        success: false,
        message: 'Échec du transfert. Veuillez réessayer.',
        transferMethod: 'direct'
      };
    }
  } catch (error) {
    console.error('Error transferring to human agent:', error);
    return {
      success: false,
      message: 'Erreur technique lors du transfert.',
      transferMethod: 'direct'
    };
  }
};

// Mock transfer implementation - replace with actual Twilio logic
const mockTransferCall = async (
  callId: string,
  agent: HumanAgent,
  conferenceSid?: string
): Promise<boolean> => {
  // Simulate transfer delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // In production, implement:
  /*
  const twilio = require('twilio')(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  
  if (conferenceSid) {
    // Add agent to existing conference
    await twilio.conferences(conferenceSid)
      .participants
      .create({
        from: env.TWILIO_FROM_NUMBER,
        to: agent.phone,
        earlyMedia: true,
        endConferenceOnExit: false
      });
  } else {
    // Create direct transfer
    await twilio.calls.create({
      from: env.TWILIO_FROM_NUMBER,
      to: agent.phone,
      url: `${env.TWILIO_TWIML_URL}/transfer-connect`
    });
  }
  */
  
  // Mock success (90% success rate)
  return Math.random() > 0.1;
};

// Generate TwiML for agent connection
export const generateAgentConnectTwiML = (agentPhone: string): string => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="fr-FR">
    Connexion avec un conseiller en cours...
  </Say>
  <Dial>
    <Number>${agentPhone}</Number>
  </Dial>
</Response>`;
};

// Handle agent availability updates
export const updateAgentAvailability = (agentId: string, isAvailable: boolean): boolean => {
  const agent = HUMAN_AGENTS.find(a => a.id === agentId);
  if (agent) {
    agent.isAvailable = isAvailable;
    console.log(`Agent ${agent.name} availability updated to: ${isAvailable}`);
    return true;
  }
  return false;
};

// Get agent statistics
export const getAgentStats = () => {
  const totalAgents = HUMAN_AGENTS.length;
  const availableAgents = HUMAN_AGENTS.filter(a => a.isAvailable).length;
  const busyAgents = HUMAN_AGENTS.filter(a => a.currentCalls > 0).length;
  const totalCurrentCalls = HUMAN_AGENTS.reduce((sum, a) => sum + a.currentCalls, 0);
  
  return {
    totalAgents,
    availableAgents,
    busyAgents,
    totalCurrentCalls,
    agents: HUMAN_AGENTS.map(agent => ({
      id: agent.id,
      name: agent.name,
      isAvailable: agent.isAvailable,
      currentCalls: agent.currentCalls,
      maxConcurrentCalls: agent.maxConcurrentCalls,
      specialties: agent.specialties
    }))
  };
};

export default {
  findAvailableAgent,
  transferToHuman,
  generateAgentConnectTwiML,
  updateAgentAvailability,
  getAgentStats
};

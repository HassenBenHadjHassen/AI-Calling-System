export class ActiveCallManager {
	private readonly activeCalls: Set<string> = new Set();
	private readonly maxGlobalCalls: number = 5;

	/**
	 * Get current active call count
	 */
	public getActiveCallCount(): number {
		return this.activeCalls.size;
	}

	/**
	 * Check if we can make a new call
	 */
	public canMakeCall(): boolean {
		return this.getActiveCallCount() < this.maxGlobalCalls;
	}

	/**
	 * Add a call to the active calls set
	 */
	public addActiveCall(callId: string): void {
		this.activeCalls.add(callId);
		console.log(
			`📞 Added call ${callId} to active calls (${this.getActiveCallCount()}/${
				this.maxGlobalCalls
			} active calls)`
		);
	}

	/**
	 * Remove a call from the active calls set
	 */
	public removeActiveCall(callId: string): void {
		this.activeCalls.delete(callId);
		console.log(
			`📞 Removed call ${callId} from active calls (${this.getActiveCallCount()}/${
				this.maxGlobalCalls
			} active calls)`
		);
	}

	/**
	 * Get the maximum number of global calls
	 */
	public getMaxGlobalCalls(): number {
		return this.maxGlobalCalls;
	}
}

// Export singleton instance
export const activeCallManager = new ActiveCallManager();

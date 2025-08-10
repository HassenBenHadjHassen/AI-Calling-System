import { ScheduledCallScheduler } from "./scheduledCallScheduler";

let schedulerInstance: ScheduledCallScheduler | null = null;

export function getScheduler(): ScheduledCallScheduler {
	if (!schedulerInstance) {
		schedulerInstance = new ScheduledCallScheduler();
	}
	return schedulerInstance;
}

export default getScheduler;

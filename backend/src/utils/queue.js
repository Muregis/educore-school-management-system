/**
 * Simple in-memory queue
 * Placeholder for Redis/Bull queue implementation
 */

class Queue {
  constructor(name) {
    this.name = name;
    this.jobs = [];
    this.processing = false;
  }

  async add(job) {
    this.jobs.push({
      ...job,
      id: Date.now(),
      status: 'pending',
      addedAt: new Date()
    });
    this.process();
  }

  async process() {
    if (this.processing || this.jobs.length === 0) {
      return;
    }

    this.processing = true;
    const job = this.jobs.shift();

    try {
      job.status = 'processing';
      await job.handler(job.data);
      job.status = 'completed';
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
    } finally {
      this.processing = false;
      this.process();
    }
  }

  getStats() {
    return {
      name: this.name,
      pending: this.jobs.filter(j => j.status === 'pending').length,
      processing: this.jobs.filter(j => j.status === 'processing').length,
      completed: this.jobs.filter(j => j.status === 'completed').length,
      failed: this.jobs.filter(j => j.status === 'failed').length
    };
  }
}

export const notificationQueue = new Queue('notifications');
export const emailQueue = new Queue('emails');
export const reportQueue = new Queue('reports');

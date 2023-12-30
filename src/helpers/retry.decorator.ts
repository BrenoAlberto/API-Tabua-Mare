type ExceptionType = new (...args: any[]) => Error;

class RetryConfig {
    exceptionType: ExceptionType;
    maxAttempts: number;
    private delayRange: [number, number];
    exponentialBackoff: boolean;

    constructor(
        exceptionType: ExceptionType = Error,
        maxAttempts: number = 5,
        delayRange: [number, number] = [1, 2],
        exponentialBackoff: boolean = false
    ) {
        this.exceptionType = exceptionType;
        this.maxAttempts = maxAttempts;
        this.delayRange = delayRange;
        this.exponentialBackoff = exponentialBackoff;
    }

    getDelayTime(attempt: number): number {
        if (this.exponentialBackoff) {
            const jitter = Math.random() * (1.1 - 0.9) + 0.9;
            const exponentialDelay = this.delayRange[0] * Math.pow(2, attempt);
            const cappedDelay = Math.min(exponentialDelay, this.delayRange[1]);
            return cappedDelay * jitter;
        } else {
            return Math.random() * (this.delayRange[1] - this.delayRange[0]) + this.delayRange[0];
        }
    }
}

function retry(retryConfigs: RetryConfig[]) {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function(...args: any[]) {
            const attemptCounters = new Map<ExceptionType, number>();
            retryConfigs.forEach(config => attemptCounters.set(config.exceptionType, 0));
            const maxAttempts = Math.max(...retryConfigs.map(config => config.maxAttempts));

            for (let attempt = 0; attempt <= maxAttempts; attempt++) {
                try {
                    return await originalMethod.apply(this, args);
                } catch (e) {
                    const error = e as Error;

                    const matchingConfig = retryConfigs.find(config => error instanceof config.exceptionType);
                    if (!matchingConfig) {
                        console.warn(`Exception without RetryConfig: ${error.message}`);
                        throw error;
                    }

                    const exceptionAttemptCounter = attemptCounters.get(matchingConfig.exceptionType) || 0;
                    if (exceptionAttemptCounter >= matchingConfig.maxAttempts) {
                        console.warn(`Max attempts exceeded for exception ${matchingConfig.exceptionType.name}: ${error.message}`);
                        throw error;
                    }

                    if (attempt === maxAttempts) {
                        console.warn('Max overall attempts exceeded');
                        throw error;
                    }

                    const delay = matchingConfig.getDelayTime(exceptionAttemptCounter);
                    console.info(`Retrying in ${delay} seconds for exception ${matchingConfig.exceptionType.name} (${exceptionAttemptCounter + 1} of ${matchingConfig.maxAttempts} attempts) - ${error.message}`);
                    new Promise(resolve => setTimeout(resolve, delay * 1000)).then(() => {
                        attemptCounters.set(matchingConfig.exceptionType, exceptionAttemptCounter + 1);
                    });
                }
            }
        };

        return descriptor as any;
    };
}

export { RetryConfig, retry };

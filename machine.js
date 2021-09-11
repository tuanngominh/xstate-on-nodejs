import {createMachine, interpret, State, assign} from 'xstate';

function longRunAsyncTask1(context, event) {
  console.log('longRunAsyncTask1 > start');
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('longRunAsyncTask1 > finish');
      resolve();
    }, 5000);
  })
}

function longRunAsyncTask2(context, event) {
  console.log('longRunAsyncTask2 > start');
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('longRunAsyncTask2 > finish');
      resolve();
    }, 5000);
  })
}

function pollLongRunAsyncTask2(context, event)  {
  console.log('pollLongRunAsyncTask2 > start', context.task2Count);
  const task2Count = 'task2Count' in event ? context.task2Count : 0;
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('pollLongRunAsyncTask2 > finish')
      resolve({
        task2Count: task2Count + 1
      });
    }, 5000);
  })
}

export const dagsMachine = createMachine(
  {
    id: 'runDag',
    initial: 'blank',
    context: {},
    states: {
      blank: {
        on: {
          NEXT: 'task1'
        }
      },
      task1: {
        initial: 'task1Start',
        states: {
          task1Start: {
            NEXT: 'task1Execute1',
          },
          task1Execute: {
            invoke: {
              src: longRunAsyncTask1,
              onDone: {target: 'task1Done'},
              onError: {target: '#error'}
            },
          },
          task1Done: {
            type: 'final'
          }
        },
        on: {
          NEXT: 'task2'
        }
      },
      task2: {
        initial: 'execute',
        states: {
          execute: {
            initial: 'task2Start',
            states: {
              task2Start: {
                invoke: {
                  src: longRunAsyncTask2,
                  onDone: {target: 'task2Done'},
                  onError: {target: '#error'}
                },
              },
              task2Done: {
                type: 'final'
              }
            },
            on: {
              NEXT: 'polling'
            }
          },
          polling: {
            invoke: {
              src: pollLongRunAsyncTask2,
              onDone: {target: 'checkPolling'},
              onError: {target: '#error'}
            }
          },
          checkPolling: {
            entry: ['setPollingResult'],
            always: [
              {target: '#finish', cond: 'tasks2Done'},
              {target: 'morePolling', cond: 'tasks2NotDone'}
            ]
          },
          morePolling: {
            NEXT: 'polling'
          }
        },
        on: {
          NEXT: 'finish'
        }
      },
      finish: {
        id: 'finish',
        type: 'final'
      },
      error: {
        id: 'error',
        type: 'final'
      }
    }
  },
  {
    actions: {
      setPollingResult: assign({
        task2Count:  (context, event) => {
          console.log('actions > setPollingResult > task2Count', context, event)
          return event.data.task2Count;
        },
      })
    },
    guards: {
      tasks2Done: (context, event) => context.task2Count === 3 ,
      tasks2NotDone: (context, event) => context.task2Count < 3
    }
  }
);

export function getMachine(previousMachineState) {
  let resolvedState = null;
  if (previousMachineState) {
    const previousState = State.create(previousMachineState);
    resolvedState = dagsMachine.resolveState(previousState);
  }

  const service = interpret(dagsMachine);
  if (resolvedState) {
    service.start(resolvedState);
  } else {
    service.start();
  }
  return service;
}

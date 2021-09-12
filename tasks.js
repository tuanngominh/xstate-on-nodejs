export function longRunAsyncTask1(context) {
  console.log('longRunAsyncTask1 > start');
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('longRunAsyncTask1 > finish');
      resolve({
        task1Done: true
      });
    }, 2000);
  })
}

export function longRunAsyncTask2(context) {
  console.log('longRunAsyncTask2 > start');
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('longRunAsyncTask2 > finish');
      resolve();
    }, 2000);
  })
}

export function pollLongRunAsyncTask2(context)  {
  console.log('pollLongRunAsyncTask2 > start', context.task2Count);
  const task2Count = 'task2Count' in context ? context.task2Count : 0;
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('pollLongRunAsyncTask2 > finish')
      resolve({
        task2Count: task2Count + 1
      });
    }, 2000);
  })
}

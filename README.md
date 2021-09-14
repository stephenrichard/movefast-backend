# back-end

## Comments

Node.Js API with Express, run by nodemon for development convenience.

Since the model and behavior is basic, I decided to use node-fs and persist data in JSON files.

The rewards are stored by week number because I assume that we can have an history of the weekly rewards. If not, we would update `generateWeeklyRewards()` to always have the dates matching the current week and remove one level in our JSON file.

In each week object, weekly rewards are stored in an object with the user ID as the key. I found it easier to retrieve the array and manipulate its values afterwards.

## Project run
```
npm i && nodemon index.js
```
```
yarn && nodemon index.js
```
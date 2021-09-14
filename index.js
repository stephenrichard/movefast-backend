const express = require('express')
const app = express()
const fs = require('fs')
const port = 3001
const usersFile = './db_files/users.json'
const rewardsFile = './db_files/rewards.json'

app.use(express.json())

app.get('/', (req, res) => {
  res.send('Hello world')
})

/**
 * GET
 * 
 * Get user weeekly rewards / Create user and rewards if necessary
 * 
 * id: int User id
 * 
 * ?query -> at: ISOString date format
 */
app.get('/users/:id/rewards', (req, res) => {
  const id = parseInt(req.params.id)
  const dateAt = req.query.at

  if (!id || !dateAt) res.status(400).send('Missing user id or date param')

  let users = []
  fs.readFile(usersFile, "utf8", (err, jsonS) => {
    if (err) return

    try {
      users = JSON.parse(jsonS)     
      const user = users.find(user => user.id === id)

      const requestedDate = new Date(dateAt)
      const weekNumber = getWeekNumber(requestedDate)
  
      if (user) { 
        fs.readFile(rewardsFile, "utf8", (err, rewardsJsonS) => {
          if (err) return
      
          try {
            rewards = JSON.parse(rewardsJsonS)
            let userRewards = []
            if (rewards[weekNumber[1]]) {
              userRewards = rewards[weekNumber[1]][id]

              res.status(200).json({
                data: userRewards
              })
            } else {
              const weeklyRewards = generateWeeklyRewards(requestedDate)
              rewards[weekNumber[1]] = {}
              rewards[weekNumber[1]][id] = weeklyRewards

              fs.writeFile(rewardsFile, JSON.stringify(rewards, null, 2), () => {
                res.status(200).json({
                  data: weeklyRewards
                })
              })
            }
          } catch (e) {
            res.status(500).send('Error parsing rewards file')
          }
        })
      } else {
        const newUser = { id: id, createdAt: new Date().toISOString() }
        
        const weeklyRewards = generateWeeklyRewards(requestedDate)

        fs.readFile(rewardsFile, "utf8", (err, rewardsJsonS) => {
          if (err) return
      
          try {
            rewards = JSON.parse(rewardsJsonS)
            if (!rewards[weekNumber[1]]) rewards[weekNumber[1]] = {}
            rewards[weekNumber[1]][id] = weeklyRewards

            users.push(newUser)

            fs.writeFile(usersFile, JSON.stringify(users, null, 2), () => {
              fs.writeFile(rewardsFile, JSON.stringify(rewards, null, 2), () => {
                res.status(201).send('New user created with rewards')
              })
            })
          } catch (e) {
            res.status(500).send('Error parsing rewards file')
          }
        })
      }
    } catch (e) {
      res.status(500).send('Error parsing file')
    }
  })
})

/**
 * PATCH
 * 
 * Redeem a rewards and return it on success
 * 
 * id: User id
 * rewardId: ISOString format date
 */
 app.patch('/users/:id/rewards/:rewardId/redeem', (req, res) => {
   const id = parseInt(req.params.id)
   const rewardId = req.params.rewardId

  if (!id || !rewardId) res.status(400).send('Missing user or reward id')

  let rewards = []
  const reqDate = new Date(rewardId)
  const weekNumber = getWeekNumber(reqDate)

  fs.readFile(rewardsFile, "utf8", (err, jsonS) => {
    if (err) return

    try {
      rewards = JSON.parse(jsonS)

      if (rewards[weekNumber[1]] && rewards[weekNumber[1]][id]) {
        const rewardIndex = rewards[weekNumber[1]][id].findIndex((reward, index) => {
          const currReward = new Date(reward.availableAt)
          return currReward.getDay() === reqDate.getDay()
        })
        const reward = rewards[weekNumber[1]][id][rewardIndex]

        if (reward && reward.expiresAt) {
          if (!reward.redeemedAt) {
            const canRedeem = dateDiffInDays(new Date(reward.availableAt), new Date())
  
            if (canRedeem === 0) {
              rewards[weekNumber[1]][id][rewardIndex] = Object.assign({}, reward, {
                redeemedAt: new Date()
              })
              fs.writeFile(rewardsFile, JSON.stringify(rewards, null, 2), () => {
                res.status(200).json({
                  data: rewards[weekNumber[1]][id][rewardIndex]
                })
              })
              // res.status(200).json({
              //   data: reward
              // })
            } else {
              res.status(401).send({ message: 'The reward is already expired' })  
            }
          } else {
            res.status(200).send({
              message: 'This reward has already been redeemed',
              data: reward,
            })
          }
        } else {
          res.status(400).send('No reward found')
        }

      } else {
        res.status(400).send('Cannot redeem this rewards ID. User ID or reward ID might be incorrect.')
      }
    } catch (e) {
      res.status(500).send('Error parsing file')
    }
  })
})

function getWeekNumber(d) {
  // Copy date so don't modify original
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  // Get first day of year
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  // Calculate full weeks to nearest Thursday
  var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
  // Return array of year and week number
  return [d.getUTCFullYear(), weekNo];
}

function generateWeeklyRewards(requestedDate) {
  const requestedDateDay = requestedDate.getDay()

  let daysBefore = []
  let daysAfter = []

  if (requestedDateDay > 0) {
    for (let i = requestedDateDay; i > 0; i--) {
      const dayBefore = new Date(requestedDate.getTime())
      dayBefore.setDate(requestedDate.getDate() - (requestedDateDay - (requestedDateDay - i)))
      const dayBeforeStart = new Date(dayBefore.getTime())
      dayBeforeStart.setUTCHours(0)
      const dayBeforeEnd = new Date(dayBefore.getTime())
      dayBeforeEnd.setUTCHours(24)

      daysBefore.push({ "availableAt": dayBeforeStart, "redeemedAt": null, "expiresAt": dayBeforeEnd })
    }
  }
  if (requestedDateDay < 6) {
    for (let i = 0; i <= 6 - requestedDateDay; i++) {
      const dayAfter = new Date(requestedDate.getTime())
      dayAfter.setDate(requestedDate.getDate() + i)
      const dayAfterStart = new Date(dayAfter.getTime())
      dayAfterStart.setUTCHours(0)
      const dayAfterEnd = new Date(dayAfter.getTime())
      dayAfterEnd.setUTCHours(24)

      daysAfter.push({ "availableAt": dayAfterStart, "redeemedAt": null, "expiresAt": dayAfterEnd })
    }
  }
  
  return [...daysBefore, ...daysAfter]
}

const _MS_PER_DAY = 1000 * 60 * 60 * 24;

// a and b are javascript Date objects
function dateDiffInDays(a, b) {
  // Discard the time and time-zone information.
  const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

  return Math.floor((utc2 - utc1) / _MS_PER_DAY);
}

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
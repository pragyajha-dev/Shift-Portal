import 'dotenv/config'
import { buildApp } from './app'
import { config } from './config'

buildApp()
  .then((app) => {
    app.listen(config.port, () => {
      console.log(`Legacy2Next API listening on http://localhost:${config.port}`)
    })
  })
  .catch((err) => {
    console.error('Failed to start server:', err)
    process.exit(1)
  })

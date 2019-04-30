# Deployment server configuration

## Using pm2 to run the server as a service

https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-ubuntu-16-04

```bash
sudo npm install -g pm2
#cd auto-update-server
#pm2 start app.js

pm2 startup systemd
# => sudo env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# utils
systemctl status pm2-ubuntu.service
pm2 list
pm2 restart app_name_or_id
```

## Using process.env to setup USERNAME and PASSWORD

pm2 config **/home/ubuntu/pm2-servers.config.js**:
```
module.exports = {
  apps : [
      {
        name: "update-server",
        script: "/home/ubuntu/auto-update-server/app.js",
        watch: true,
        env: {
            "PORT": 3000,
            "NODE_ENV": "production",
            "USERNAME": "xxx",
            "PASSWORD": "xxx"
        }
      }
  ]
}
```

pm2 is **launched** as:
```
pm2 start pm2-servers.config.js
```

class InstagramBot {

    constructor() {
        this.firebase_db = require('./db');
        this.config = require('./config/puppeteer.json');
    }
    
    async initPuppeter() {
    const puppeteer = require('puppeteer');
    this.browser = await puppeteer.launch({
        headless: this.config.settings.headless,
        args: ['--no-sandbox'],
    });
    this.page = await this.browser.newPage();
    this.page.setViewport({width: 1500, height: 764});
}

async visitInstagram() {
    await this.page.goto(this.config.base_url, {timeout: 60000});
    await this.page.waitFor(2500);
    await this.page.click(this.config.selectors.home_to_login_button);
    await this.page.waitFor(2500);
    /* Click on the username field using the field selector*/
    await this.page.click(this.config.selectors.username_field);
    await this.page.keyboard.type(this.config.username);
    await this.page.click(this.config.selectors.password_field);
    await this.page.keyboard.type(this.config.password);
    await this.page.click(this.config.selectors.login_button);
    await this.page.waitForNavigation();
    //Close Turn On Notification modal after login
    await this.page.click(this.config.selectors.not_now_button);
  }
  
  async visitHashtagUrl() {
    const shuffle = require('shuffle-array');
    let hashTags = shuffle(this.config.hashTags);
    // loop through hashTags
    for (let tagIndex = 0; tagIndex < hashTags.length; tagIndex++) {
        console.log('<<<< Currently Exploring >>>> #' + hashTags[tagIndex]);
        //visit the hash tag url
        await this.page.goto(`${this.config.base_url}/explore/tags/` + hashTags[tagIndex] + '/?hl=en');
        // Loop through the latest 9 posts
        await this._doPostLikeAndFollow(this.config.selectors.hash_tags_base_class, this.page);
    }
  }
  async unFollowUsers() {
    let date_range = new Date().getTime() - (this.config.settings.unfollow_after_days * 86400000);

    // get the list of users we are currently following
    let following = await this.firebase_db.getFollowings();
    let users_to_unfollow = [];
    if (following) {
        const all_users = Object.keys(following);
        // filter our current following to get users we've been following since day specified in config
        users_to_unfollow = all_users.filter(user => following[user].added < date_range);
    }

    if (users_to_unfollow.length) {
        for (let n = 0; n < users_to_unfollow.length; n++) {
            let user = users_to_unfollow[n];
            await this.page.goto(`${this.config.base_url}/${user}/?hl=en`);
            await this.page.waitFor(1500 + Math.floor(Math.random() * 500));

            let followStatus = await this.page.evaluate(x => {
                let element = document.querySelector(x);
                return Promise.resolve(element ? element.innerHTML : '');
            }, this.config.selectors.user_unfollow_button);

            if (followStatus === 'Following') {
                console.log('<<< UNFOLLOW USER >>>' + user);
                //click on unfollow button
                await this.page.click(this.config.selectors.user_unfollow_button);
                //wait for a sec
                await this.page.waitFor(1000);
                //confirm unfollow user
                await this.page.click(this.config.selectors.user_unfollow_confirm_button);
                //wait for random amount of time
                await this.page.waitFor(20000 + Math.floor(Math.random() * 5000));
                //save user to following history
                await this.firebase_db.unFollow(user);
            } else {
                //save user to our following history
                this.firebase_db.unFollow(user);
            }
        }

    }
  }

async closeBrowser(){
        await this.browser.close();
    }
  }
}

const Bot = require('./Bot');// this directly imports the Bot/index.js file
const config = require('./Bot/config/puppeteer');

const run = async () => {
    const bot = new Bot();

    const startTime = Date();

    await bot.initPuppeter().then(() => console.log("PUPPETEER INITIALIZED"));

    await bot.visitInstagram().then(() => console.log("BROWSING INSTAGRAM"));

    await bot.visitHashtagUrl().then(() => console.log("VISITED HASH-TAG URL"));

    await bot.unFollowUsers();

    await bot.closeBrowser().then(() => console.log("BROWSER CLOSED"));

    const endTime = Date();

    console.log(`START TIME - ${startTime} / END TIME - ${endTime}`)

};

run().catch(e=>console.log(e.message));
//run bot at certain interval we have set in our config file
setInterval(run, config.settings.run_every_x_hours * 3600000);

const got = require('@/utils/got');
const path = require('path');
const { art } = require('@/utils/render');
const parser = require('@/utils/rss-parser');
const yaml = require('js-yaml');
const MarkDown = require('markdown-it')({
    html: true,
    linkify: true,
});

const feedUrl = 'https://huggingface.co/blog/feed.xml';

const readMeta = (md) => {
    const lines = md.split('\n');
    if (lines[0].trim() !== '---') {
        return { md, config: {} };
    }

    const end = lines.indexOf('---', 1);
    if (end === -1) {
        return { md, config: {} };
    }
    const meta = lines.slice(1, end);
    return { md: lines.slice(end + 1).join('\n'), config: yaml.load(meta.join('\n')) };
};

module.exports = async (ctx) => {
    const feed = await parser.parseURL(feedUrl);
    const items = await Promise.all(
        feed.items.map((item) =>
            ctx.cache.tryGet(item.guid, async () => {
                const lastUrlComponent = item.guid.split('/').pop();
                const mdUrl = `https://raw.githubusercontent.com/huggingface/blog/main/${lastUrlComponent}.md`;
                const response = await got(mdUrl);
                const { md, config } = readMeta(response.data);

                const { thumbnail } = config;

                const single = {
                    title: item.title,
                    description: art(path.join(__dirname, 'templates/blog.art'), {
                        content: MarkDown.render(md) || 'No Content',
                        thumbnail,
                    }),
                    pubDate: item.pubDate,
                    link: item.guid,
                    author: config.authors.map((author) => author.user).join(','),
                };
                return single;
            })
        )
    );
    ctx.state.data = {
        title: feed.title,
        link: feed.link,
        description: feed.description,
        item: items,
    };
};

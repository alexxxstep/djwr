const path = require("path");

module.exports = {
  entry: "./frontend/src/js/main.js",
  output: {
    path: path.resolve(__dirname, "frontend/dist"),
    filename: "bundle.js",
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
      {
        test: /\.css$/,
        use: [
          "style-loader",
          "css-loader",
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: [require("tailwindcss"), require("autoprefixer")],
              },
            },
          },
        ],
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/,
        type: "asset/resource",
        generator: {
          filename: "assets/[name][ext]",
        },
      },
    ],
  },
  resolve: {
    extensions: [".js", ".json"],
  },
  devtool: "source-map",
  devServer: {
    static: {
      directory: path.join(__dirname, "frontend/dist"),
    },
    port: 8080,
    hot: true,
    open: false,
  },
  optimization: {
    minimize: true,
  },
};


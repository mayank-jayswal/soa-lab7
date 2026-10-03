const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "userId is required"],
    },
    productId: {
      type: String,
      required: [true, "productId is required"],
    },
    quantity: {
      type: Number,
      required: [true, "quantity is required"],
      min: [1, "Quantity must be at least 1"],
      default: 1,
    },
    unitPrice: {
      type: Number,
      required: [true, "unitPrice is required"],
    },
    totalPrice: {
      type: Number,
      required: [true, "totalPrice is required"],
    },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED"],
      default: "CONFIRMED",
    },
    // Snapshots of data from User & Product services at time of order creation
    userDetails: {
      name: String,
      email: String,
      department: String,
    },
    productDetails: {
      name: String,
      category: String,
    },
  },
  {
    timestamps: true,
  }
);

OrderSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    return ret;
  },
});

module.exports = mongoose.model("Order", OrderSchema);

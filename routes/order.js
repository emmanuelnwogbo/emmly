const router = require('express').Router();
const async = require('async');
const stripe = require('stripe')('sk_test_nQxRr138YoEKQxYf69MqIVPs');
const Gig = require('../models/gig');
const Order = require('../models/order');
const User = require('../models/user');


const fee = 3.15;

router.get('/checkout/single_package/:id', (req, res, next) => {
  Gig.findOne({_id: req.params.id}, function(err, gig) {
    let totalPrice = gig.price + fee;
    req.session.gig = gig;
    req.session.price = totalPrice;
    res.render('checkout/single_package', {gig: gig, totalPrice: totalPrice});
  });
});

router.get('/checkout/process_cart', (req, res, next) => {
  User.findOne({ _id: req.user._id })
    .populate('cart')
    .exec(function(err, user) {
      let price = 0;
      let cartIsEmpty = true;

      if(user.cart.length > 0) {
        user.cart.map(function(item) {
          price += item.price;
        });

        var totalPrice = price + fee;
      }
      else {
        cartIsEmpty = false;
      }

      req.session.price = totalPrice;
      req.session.gig = user.cart;
      res.render('order/cart', { foundUser: user, totalPrice: totalPrice, sub_total: price, cartIsEmpty: cartIsEmpty});
    });
});

router.route('/payment')
  .get((req, res, next) => {
    res.render('checkout/payment');
  })
  .post((req, res, next) => {
    let gig = req.session.gig;
    let price = req.session.price;

    price *= 100;

    // Create a new customer and then a new charge for that customer:

    stripe.customers.create({
      email: req.user.email
    }).then(function(customer){
      return stripe.customers.createSource(customer.id, {
        source: req.body.stripeToken
      });
    }).then(function(source) {
      return stripe.charges.create({
        amount: price,
        currency: 'usd',
        customer: source.customer
      });
    }).then(function(charge) {
      let order = new Order();

      order.buyer = req.user._id;
      order.seller = gig.owner;
      order.gig = gig._id;

      order.save(function(err) {
        req.session.gig = null;
        req.session.price = null;

        res.redirect('/users/' + req.user._id + '/orders/' + order._id);
      });
    }).catch(function(err) {
      // Deal with an error
      console.log(err);
    });
  });

  router.route('/payment/cart')
    .get((req, res, next) => {
      res.render('checkout/payment');
    })
    .post((req, res, next) => {
      let gigs = req.session.gig;
      let price = req.session.price;

      price *= 100;

      // Create a new customer and then a new charge for that customer:

      stripe.customers.create({
        email: req.user.email
      }).then(function(customer){
        return stripe.customers.createSource(customer.id, {
          source: req.body.stripeToken
        });
      }).then(function(source) {
        return stripe.charges.create({
          amount: price,
          currency: 'usd',
          customer: source.customer
        });
      }).then(function(charge) {

          gigs.map(function(gig) {
            let order = new Order();

            order.buyer = req.user._id;
            order.seller = gig.owner;
            order.gig = gig._id;

            order.save(function(err) {
              req.session.gig = null;
              req.session.price = null;
            });
          });
          User.update({ _id: req.user._id }, { $set: { cart: []}}, function(err, updated) {
            if(updated) {
              res.redirect('/users/' + req.user._id + '/orders');
            }
          });
      }).catch(function(err) {
        // Deal with an error
        console.log(err);
      });
    });

//CHAT PAGE
router.get('/users/:userId/orders/:orderId', (req, res, next) => {
  req.session.orderId = req.params.orderId;
  Order.findOne({ _id: req.params.orderId })
    .populate('buyer')
    .populate('seller')
    .populate('gig')
    .deepPopulate('messages.owner')
    .exec(function(err, order) {
      console.log(order);
      res.render('order/order-room', { layout: 'chat_layout', order: order, helpers: {
        if_equals: function(a, b, opts) {
          if(a.equals(b)) {
            return opts.fn(this);
          }
          else {
            return opts.inverse(this);
          }
        }
      }});
    });
});

router.get('/users/:id/manage_orders', (req, res, next) => {
  Order.find({ seller: req.user._id})
  .populate('buyer')
  .populate('seller')
  .populate('gig')
  .exec(function(err, orders) {
    res.render('order/order-seller', { orders: orders});
  });
});

router.get('/users/:id/orders', (req, res, next) => {
  Order.find({ buyer: req.user._id})
  .populate('buyer')
  .populate('seller')
  .populate('gig')
  .exec(function(err, orders) {
    res.render('order/order-buyer', { orders: orders });
  });
});

router.post('/add-to-cart', (req, res, next) => {
  const gigId = req.body.gig_id;

  User.update(
    {
      _id: req.user._id
    },
    {
      $push: { cart: gigId}
    }, function(err, count) {
      res.json("Added to cart");
    }
  );
});

router.post('/remove-item', (req, res, next) => {
  const gigId = req.body.gig_id;

  async.waterfall([
    function(callback) {
      Gig.findOne({_id: gigId}, function(err, gig) {
        callback(err, gig);
      });
    },

    function(gig, callback) {
      User.update(
        {
          _id: req.user._id
        },
        {
          $pull: { cart: gigId}
        }, function(err, count) {
          let totalPrice = req.session.price - gig.price;
          res.json({totalPrice: totalPrice, price: gig.price});
        }
      );
    }
  ]);
});

module.exports = router;

describe( 'Package events', function () {

  var
    Klass,
    pkgDef,
    pkgInst,
    eventNames = [
      'onBegin','onEnd','onEngage','onNode',
      'onRelease','onScope','onTraverse',
      'onTraversed','onTraversing'
    ],
    stuffObj = [],
    stuff = {'a':1,'a2':'foo', 'c': stuffObj}
  ;

  beforeEach(function () {
    Klass = Panzer.create();
    pkgDef = Klass.pkg('a');
    pkgInst = pkgDef(new Klass(stuff));
  });

  it( 'should scope callbacks to their package-instance', function () {
    eventNames.forEach(function (eventName) {
      pkgDef[eventName] = sinon.spy();
    });
    pkgDef.onTraverse = sinon.spy(function () {
      this.tank.stop();
    });
    pkgInst.tank.go(1);
    pkgInst.tank.go(1);
    eventNames.forEach(function (eventName) {
      pkgDef[eventName].should.have.always.been.calledOn(pkgInst);
    });
  });

  it( 'should occur in the expected order', function () {
    var
      order = [],
      pkgInst = pkgDef(new Klass())
    ;

    function trace(n) {
      return function () {
        order.push(n);
      }
    }

    pkgDef.onBegin = trace(1);
    pkgDef.onNode = trace(2);
    pkgDef.onEngage = trace(3);
    pkgDef.onScope = trace(4);
    pkgDef.onTraverse = trace(5);
    pkgDef.onTraversing = trace(6);
    pkgDef.onTraversed = trace(7);
    pkgDef.onRelease = trace(8);
    pkgDef.onEnd = trace(9);

    pkgInst.tank.go(1);

    // validate simple traversal
    order.should.eql([1,2,3,4,5,7,5,7,8,9]);
    order = [];
    pkgInst.tank.currentIndex.should.equal(1);

    pkgDef.onTraverse = function () {
      this.tank.stop();
      order.push(5);
    };
    pkgInst.tank.go(1);
    // valieate interrupting navigation
    order.should.eql([1,3,5,8,9]);
    order = [];

    pkgDef.onTraverse = trace(5);
    pkgInst.tank.go(1);
    // validate resuming navigation
    order.should.eql([1,3,6,7,5,7,8,9]);

    // test stopping from each event
    [
      ['onBegin', [1,9]],
      ['onEnd', [1,2,3,4,5,7,5,7,8,9]],
      ['onEngage', [1,2,3,8,9]],
      ['onNode', [1,2,9]],
      ['onRelease', [1,2,3,4,5,7,5,7,8,9]],
      ['onScope', [1,2,3,4,8,9]],
      ['onTraverse', [1,2,3,4,5,8,9]],
      ['onTraversed', [1,2,3,4,5,7,8,9]]
    ].forEach(function (seq) {
      var
        eventName = seq[0],
        expectedOrder = seq[1],
        prevCallback = pkgDef[eventName]
      ;
      pkgInst.tank.go(0);
      order = [];

      pkgDef[eventName] = function () {
        this.tank.stop();
        prevCallback();
      };
      pkgInst.tank.go(1);

      order.should.eql(expectedOrder);
      pkgDef[eventName] = prevCallback;
    });
  });

  it( 'should pass the event name as the first callback argument', function () {
    eventNames.forEach(function (eventName) {
      pkgDef[eventName] = sinon.spy();
    });
    pkgDef.onTraverse = sinon.spy(function () {
      this.tank.stop();
    });
    pkgInst.tank.go(1);
    pkgInst.tank.go(1);
    eventNames.forEach(function (eventName) {
      pkgDef[eventName]
        .firstCall.args[0].should.equal(eventName.charAt(2).toLowerCase() +  eventName.substr(3));
    });
   });

  describe( '.onBegin & .onEnd', function () {

    it( 'should trigger when tank.go() is called (outside of a loop)', function () {
      pkgDef.onBegin = pkgDef.onEnd = sinon.spy();
      pkgInst.tank.go();
      pkgDef.onBegin.should.have.been.calledTwice;
    });

  });

  describe( '.onNode', function () {

    it( 'should include indexes for the current and old node', function () {
      pkgDef.onNode = sinon.spy();
      pkgInst.tank.go(1);

      pkgDef.onNode.should.have.been.calledOnce;
      pkgDef.onNode.firstCall.args.should.have.length(3);
      pkgDef.onNode.firstCall.args[1].should.equal(1);
      pkgDef.onNode.firstCall.args[2].should.equal(0);

    });

  });

  describe( '.onRelease and .onEngage', function () {

    it( 'should wrap .onScope and traversal events', function () {
      var EventsBetweenReleaseAndEngage = eventNames.slice(5);
      eventNames.slice(2).forEach(function (eventName) {
        pkgDef[eventName] = sinon.spy();
      });
      pkgDef.onNode = function () {
        if (pkgDef.onEngage.callCount) {
          EventsBetweenReleaseAndEngage.forEach(function (eventName) {
            console.log(eventName);
            if (pkgDef[eventName].called) {
              pkgDef.onEngage.should.have.been.calledBefore(pkgDef[eventName]);
              pkgDef.onRelease.should.have.been.calledAfter(pkgDef[eventName]);
              console.log('OK!');
            } else {
              console.log('NOT CALLED!');
            }
          });
          eventNames.slice(2).forEach(function (eventName) {
            if (eventName !== 'onNode') {
              pkgDef[eventName].reset();
            }
          });
        }
      };
      pkgInst.tank.go(5);
    });

  });

  describe( '.onScope', function () {

    it( 'should indicating entry or exit with a second argument', function () {
      pkgDef.onScope = sinon.spy();
      pkgInst.tank.go(1);
      pkgInst.tank.go(0);

      pkgDef.onScope.should.have.been.calledTwice;
      pkgDef.onScope.firstCall.args[1].should.have.been.ok;
      pkgDef.onScope.secondCall.args[1].should.not.have.been.ok;
    });

  });

  describe( '.onTraversed', function () {

    it( 'should not occur if stopped during traverse/traversing', function () {
      pkgDef.onTraversed = sinon.spy();

      pkgInst.tank.go(0);
      pkgDef.onTraversed.should.have.been.called;
      pkgDef.onTraversed.reset();

      pkgDef.onTraverse = function () {
        this.tank.stop();
      };

      pkgInst.tank.go(0);
      pkgDef.onTraversed.should.not.have.been.called;

    });

  });

  describe( '.onTraversing', function () {

    it( 'should occur if traverse/traversed callback stops navigation', function () {
      pkgDef.onTraverse = pkgDef.onTraversing = function () {
        this.tank.stop();
      };
      pkgDef.onTraversing  = sinon.spy(pkgDef.onTraversing);
      pkgInst.tank.go(0);
      pkgDef.onTraversing.should.not.have.been.called;

      pkgInst.tank.go(0);
      pkgDef.onTraversing.should.have.been.calledOnce;

      pkgInst.tank.go(0);
      pkgDef.onTraversing.should.have.been.calledTwice;
    });

    it( 'should occur on the previous node/phase before resuming navigation', function () {
      var curNode = -1;
      pkgDef.onTraversing = sinon.spy(function () {
        curNode = this.tank.currentIndex;
      });
      pkgDef.onTraverse = sinon.spy(function () {
        this.tank.stop();
      });

      pkgInst.tank.go(3);
      pkgInst.nodes.should.have.length(5);
      pkgDef.onTraversing.should.not.have.been.called;

      pkgInst.tank.go(3);
      pkgDef.onTraversing.should.have.been.calledOnce;
      pkgDef.onTraverse.firstCall.args[1]
        .should.equal(pkgDef.onTraversing.firstCall.args[1]);
      curNode.should.equal(1);
    });

  });

  describe( 'traversals', function () {

    beforeEach(function () {
      pkgDef.onTraverse = pkgDef.onTraversed = sinon.spy();
    });

    it( 'should pass 0 when on a node', function () {
      pkgInst.tank.go(0);
      pkgDef.onTraverse.calledWith(0);
    });

    it( 'should pass 1 when entering a node', function () {
      pkgInst.tank.go(1);
      pkgDef.onTraverse.calledWith(1);
    });

    it( 'should pass 2 when exiting a node', function () {
      pkgInst.tank.go(1);
      pkgInst.tank.go(0);
      pkgDef.onTraverse.calledWith(2);
    });

    it( 'should pass 3 when bypassing a node, down the tree', function () {
      pkgInst.tank.go(3);
      pkgDef.onTraverse.calledWith(3);
    });

    it( 'should pass 4 when bypassing a node, up the tree', function () {
      pkgInst.tank.go(3);
      pkgInst.tank.go(2);
      pkgDef.onTraverse.calledWith(5);
    });

  });

});